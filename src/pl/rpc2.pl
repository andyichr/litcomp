#!/usr/bin/env perl

use Switch;
use POSIX qw(SIGHUP);

use FileHandle;
use IPC::Open2;

use JSON;
use Data::Dumper;

use strict;

my $json = JSON->new->allow_nonref;

my @input = <STDIN>;
my $req = $json->decode( join( "", @input ) );

my $error = sub {
	my $message = shift;
	print STDERR "ERROR: $message";
	print STDERR "\n";
	exit 1;
};

# build shell pipeline given request
my @path = split ( ":", $ENV{PATH} );

################################################################################
# used to derive a new map having the same effect as applying two maps
# sequenially
################################################################################
sub compose_map {
	my $map_left = shift;
	my $map_right = shift;

	if ( $map_left->{"codomain"}->() && $map_left->{"codomain"}->() ne $map_right->{"domain"}->() ) {
		$error->( "cannot compose maps because codomain of map_left '" . $map_left->{"codomain"}->()
				. "' does not equal domain of map_right '" . $map_right->{"domain"}->() . "'" );
	}

	return {
		"read" => sub {
			my $buf = $map_right->{"read"}->();
			return $buf;
		},
		"write" => sub {
			my $buf = shift;
			$map_left->{"write"}->( $buf );
			my $left_buf = $map_left->{"read"}->();
			$map_right->{"write"}->( $left_buf );
		},
		"destroy" => sub {
			$map_left->{"destroy"}->();
			$map_right->{"destroy"}->();
		},
		"domain" => sub {
			my $domain = $map_left->{"domain"}->();

			if ( ! $domain ) {
				$domain = $map_right->{"domain"}->();
			}

			return $domain;
		},
		"codomain" => sub {
			my $codomain = $map_right->{"codomain"}->();
			return $codomain;
		}
	};
}

################################################################################
# parses map signature of form: F : D -> C
################################################################################
sub parse_map {
	my $map_name = shift;
	my @map_parts = split( " : ", $map_name );
	my $map_function = $map_parts[0];
	my @domain_parts = split( " -> ", $map_parts[1] );
	my $domain = $domain_parts[0];
	my $codomain = $domain_parts[1];

	return {
		"function" => sub { $map_function },
		"domain" => sub { $domain },
		"codomain" => sub { $codomain }
	};
}

################################################################################
# derives a map structure given a dynamic category and requested map
################################################################################
sub dynamic_cat_map {
	my %args = @_;
	my $req = $args{"req"};
	my $cat = $args{"category"};

	my $map = parse_map( $req->[1] );
	my $map_domain = $map->{"domain"}->();

	if ( $map_domain eq "_" && $args{"expected_domain"} ) {
		$map_domain = $args{"expected_domain"};
	}

	# search category for matching arrow
	foreach ( @{$cat->{"arrows"}} ) {
		my $arrow = $_;

		if ( $map->{"function"}->() eq $arrow->{"name"}
				&& $map_domain eq $arrow->{"domain"}
				&& $map->{"codomain"}->() eq $arrow->{"codomain"} ) {
			return {
				"read" => sub {
					open my $fh, $arrow->{"out"};
					my @lines = <$fh>;
					close $fh;
					my $buf = join( "", @lines );
					return $buf;
				},
				"write" => sub {
					my $buf = shift;
					open my $fh, ">" . $arrow->{"in"};
					print $fh $buf;
					close $fh;
				},
				"destroy" => sub {
					kill SIGHUP, $arrow->{"pid"};
					waitpid $arrow->{"pid"}, 0;
					unlink $arrow->{"in"};
					unlink $arrow->{"out"};
				},
				"domain" => sub {
					return $arrow->{"domain"};
				},
				"codomain" => sub {
					return $arrow->{"codomain"};
				}
			};
		}
	}

	return undef;
}

################################################################################
# derives a map structure given a requested category map
################################################################################
my $model_map = sub {
	my %args = @_;
	my $req = $args{"req"};
	my $expected_domain = $args{"expected_domain"};
	my $map = parse_map( $req->[1] );
	my $map_function = $map->{"function"}->();
	my $domain = $map->{"domain"}->();
	my $codomain = $map->{"codomain"}->();

	# support inference of the domain
	if ( $domain eq "_" ) {
		$domain = $expected_domain;
	}

	if ( $expected_domain && $domain ne $expected_domain ) {
		$error->( "domain '" . $domain . "' did not match expected value of '" . $expected_domain . "'" );
	}

	my $child_out;
	my $child_in;
	my $cmd;
	my $found_arrow;

	foreach ( @path ) {
		my $base_dir = $_;
		$cmd = $base_dir . "/" . $domain . "/" . $codomain . "/" . $map_function;

		if ( -e $cmd ) {
			$found_arrow = 1;
			last;
		}
	}

	if ( !$found_arrow ) {
		$error->( "arrow not found: $map_function : $domain -> $codomain" );
	}

	my $pid = open2( $child_out, $child_in, $cmd );

	return {
		"read" => sub {
			my $out;

			while ( my $buf = <$child_out> ) {
				$out .= $buf;
			}

			close $child_out;

			return $out;
		},
		"write" => sub {
			my $buf = shift;
			print $child_in $buf;
			close $child_in;
		},
		"destroy" => sub {
			kill SIGHUP, $pid;
		},
		"domain" => sub {
			$domain;
		},
		"codomain" => sub {
			$codomain;
		}
	};
};

################################################################################
# generates a map structure given a literal value
################################################################################
sub value_map {
	my $value = shift;
	my $buf = $json->encode( $value );

	return {
		"read" => sub {
			my $result = $buf;
			$buf = undef;
			return $result;
		},
		"write" => sub {
			# do nothing since this map is a literal value
		},
		"destroy" => sub {
			# do nothing since no external resources have been allocated
		},
		"domain" => sub {
			return undef;
		},
		"codomain" => sub {
			return undef;
		}
	};
}

################################################################################
# derive a function which derives a map given a request. the request argument
# of this function must define a category
################################################################################
sub cat_map_fn {
	my %args = @_;
	my $req = $args{"req"};
	my $map_fn = $args{"map_fn"};

	my $cat_map = req_map( $req, $map_fn );
	$cat_map->{"write"}->();
	my $cat_json = $cat_map->{"read"}->();
	my $cat = $json->decode( $cat_json );

	return sub {
		# if arrow exists in generated category, derive a map structure
		my %args = @_;

		my $map = dynamic_cat_map(
			"req" => $args{"req"},
			"expected_domain" => $args{"expected_domain"},
			"category" => $cat
		);

		if ( ! defined( $map ) ) {
			$map = $map_fn->( %args );
		}

		return $map;
	};
}

################################################################################
# derive a map structure given a request
################################################################################
sub req_map {
	my $req = shift;
	my $map_fn = shift;

	my $type = sub {
		if ( ref( $req ) eq "ARRAY" ) {
			return $req->[0];
		} else {
			return undef;
		}
	}->();

	# in cases where a category is generated, it is not necessarily
	# the case that model_map should be used to derive a map from the
	# request

	if ( ! defined( $map_fn ) ) {
		$map_fn = sub {
			$model_map->( @_ );
		};
	}

	switch ( $type ) {

		case "map" {
			my $child_map = req_map( $req->[2], $map_fn );

			my $map = $map_fn->(
				"req" => $req,
				"expected_domain" => $child_map->{"codomain"}->()
			); 

			return compose_map( $child_map, $map );
		}

		case "in" {
			$map_fn = cat_map_fn(
				"req" => $req->[1],
				"map_fn" => $map_fn
			);

			return req_map( $req->[2], $map_fn );
		}

		else {
			return value_map( $req );
		}

	}
}

my $req_map = req_map( $req );
$req_map->{"write"}->();
my $result = $req_map->{"read"}->();
$req_map->{"destroy"}->();
print $result;
